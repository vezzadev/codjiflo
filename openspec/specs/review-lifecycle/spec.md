# review-lifecycle Specification

## Purpose
Review state machine (Active → Completed/Aborted), legal transitions, who-can-do-what permissions, policy gates for completion, reviewer roster management, and reactivation rules.

## Requirements
### Requirement: Review State Set
The system SHALL model every review using exactly one of the following states at any time: Created, Draft, Active, Completed, Aborted, or Expired.

#### Scenario: Initial state after server creation
- **WHEN** a review is first persisted on the server but has not yet been published
- **THEN** the system assigns the review the Created state

#### Scenario: Draft pull request
- **WHEN** the underlying pull request is in draft mode
- **THEN** the review is assigned the Draft state and is treated as "Review Open" for participation purposes

#### Scenario: Open for review
- **WHEN** a review has been published and is open for reviewer activity
- **THEN** the review is in the Active state

### Requirement: Legal State Transitions
The system SHALL only permit transitions that match the documented state machine: Draft to Active (Publish), Active to Completed (Complete), Active or Draft to Aborted (Recall/Abandon), Aborted to Active (Reactivate), and Active to Expired (timeout).

#### Scenario: Publishing a draft review
- **WHEN** any participant invokes Publish on a Draft review
- **THEN** the review transitions to Active

#### Scenario: Completing an active review
- **WHEN** any participant invokes Complete on an Active review and all required policies pass
- **THEN** the review transitions to Completed

#### Scenario: Recalling a review
- **WHEN** any participant invokes Recall/Abandon on a Draft or Active review
- **THEN** the review transitions to Aborted

#### Scenario: Reactivating an aborted review
- **WHEN** the author invokes Reactivate on an Aborted review
- **THEN** the review transitions back to Active

#### Scenario: Rejecting illegal transitions
- **WHEN** any actor attempts a transition that is not in the documented state machine (for example, Completed back to Active)
- **THEN** the system rejects the request and leaves the state unchanged

### Requirement: Author-Only Lifecycle Actions
The system SHALL restrict Recall and Reactivate transitions to the review's author, rejecting attempts by reviewers or other users.

#### Scenario: Reviewer attempts recall
- **WHEN** a non-author reviewer invokes Recall on an Active review
- **THEN** the system rejects the action and the review remains Active

#### Scenario: Reviewer attempts reactivate
- **WHEN** a non-author reviewer invokes Reactivate on an Aborted review
- **THEN** the system rejects the action and the review remains Aborted

#### Scenario: Author reactivates
- **WHEN** the author invokes Reactivate on an Aborted review
- **THEN** the system transitions the review back to Active

### Requirement: Shared Lifecycle Actions
The system SHALL allow either the author or any reviewer to invoke Publish and Complete, while restricting Complete to authors and reviewers only (not arbitrary users).

#### Scenario: Reviewer publishes draft
- **WHEN** a reviewer invokes Publish on a Draft review
- **THEN** the review transitions to Active

#### Scenario: Reviewer completes review
- **WHEN** a reviewer invokes Complete on an Active review and all policies pass
- **THEN** the review transitions to Completed

#### Scenario: Non-participant attempts complete
- **WHEN** a user who is neither the author nor a listed reviewer invokes Complete
- **THEN** the system rejects the request

### Requirement: Policy Gating For Completion
The system SHALL block the Active to Completed transition for pull requests until all configured policies evaluate to Approved, including Required Reviewers approval, ApproverCount threshold, Build success (if configured), Comment Resolution (if enabled), Work Item Linking (if required), and a merge/rebase-able git history.

#### Scenario: Required reviewer has not approved
- **WHEN** Complete is invoked while at least one Required reviewer has not signed off
- **THEN** the system rejects completion and the review stays Active

#### Scenario: Build policy failing
- **WHEN** Complete is invoked while the Build policy is in Rejected or Running state
- **THEN** the system rejects completion and the review stays Active

#### Scenario: All policies approved
- **WHEN** Complete is invoked and every configured policy is in the Approved state
- **THEN** the system transitions the review to Completed

### Requirement: Policy Evaluation States
The system SHALL evaluate each configured policy as exactly one of Queued, Running, Approved, or Rejected and expose the current evaluation result to completion checks and the UI.

#### Scenario: Policy still running
- **WHEN** a policy evaluation is in progress
- **THEN** the system reports the policy as Running and treats it as not yet Approved for completion gating

#### Scenario: Policy rejected
- **WHEN** a policy evaluation produces a failing result
- **THEN** the system reports the policy as Rejected and blocks completion until it is re-evaluated to Approved

### Requirement: Terminal Read-Only States
The system SHALL treat Completed, Aborted, and Expired as terminal read-only states in which no new comments, status changes, or iterations may be created, with Reactivate from Aborted being the only permitted exit.

#### Scenario: Comment attempt on completed review
- **WHEN** any user attempts to add a comment to a Completed review
- **THEN** the system rejects the comment and surfaces the review as read-only

#### Scenario: Iteration attempt on expired review
- **WHEN** the author attempts to create a new iteration on an Expired review
- **THEN** the system rejects the request

#### Scenario: Reactivate is the only exit from aborted
- **WHEN** any actor attempts a transition from Aborted other than Reactivate
- **THEN** the system rejects the request

### Requirement: Iteration Creation Scope
The system SHALL allow only the review's author to create new iterations, and only while the review is in the Active or Draft state (see `iterations` capability for iteration mechanics).

#### Scenario: Reviewer attempts iteration creation
- **WHEN** a reviewer attempts to create an iteration on an Active review
- **THEN** the system rejects the request

#### Scenario: Author creates iteration on draft review
- **WHEN** the author pushes a new iteration to a Draft review
- **THEN** the system accepts and records the iteration

#### Scenario: Author attempts iteration on terminal state
- **WHEN** the author attempts to create an iteration on a Completed, Aborted, or Expired review
- **THEN** the system rejects the request

### Requirement: Reviewer Status Tracking
The system SHALL track each reviewer's status as one of NotStarted, Started, Reviewing, Waiting, SignedOff, SignedOffWithComments, InviteOnly, Declined, or Rejected, and SHALL allow each reviewer to change only their own status.

#### Scenario: Reviewer updates own status
- **WHEN** a reviewer transitions their status from Reviewing to SignedOff
- **THEN** the system records the new status against that reviewer

#### Scenario: Author cannot edit reviewer status
- **WHEN** the author attempts to change another reviewer's status
- **THEN** the system rejects the request

#### Scenario: Rejecting reviewer blocks completion
- **WHEN** a Required reviewer has status Rejected
- **THEN** the system treats completion as blocked until that reviewer changes status to SignedOff or SignedOffWithComments

### Requirement: Reviewer Roster Management
The system SHALL allow both the author and reviewers to add reviewers, and SHALL restrict removing reviewers to the author only. Each reviewer SHALL be classified as Required or Optional.

#### Scenario: Reviewer invites another reviewer
- **WHEN** an existing reviewer adds another user as a reviewer
- **THEN** the system records the addition

#### Scenario: Reviewer attempts removal
- **WHEN** a reviewer attempts to remove another reviewer from the roster
- **THEN** the system rejects the request

#### Scenario: Author removes reviewer
- **WHEN** the author removes a reviewer from the roster
- **THEN** the system updates the roster and re-evaluates completion gating against remaining Required reviewers

### Requirement: Reactivation Preserves Review Context
The system SHALL preserve existing comments, reviewer roster, reviewer statuses, and iteration history when a review transitions from Aborted back to Active via Reactivate (see `comments` and `iterations` capabilities for storage semantics).

#### Scenario: Comments survive reactivation
- **WHEN** the author reactivates an Aborted review
- **THEN** all comments that existed prior to the abort remain attached to the review

#### Scenario: Reviewer statuses survive reactivation
- **WHEN** the author reactivates an Aborted review
- **THEN** each reviewer's last recorded status is preserved

