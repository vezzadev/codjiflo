/**
 * Iteration selector component
 * S-3.5: Iteration Selector & Comparison
 * AC-3.5.1 through AC-3.5.19
 */

import { useEffect } from 'react';
import { useIterationStore } from '../stores/useIterationStore';
import { usePRStore } from '@/features/pr';

/**
 * Iteration selector with two dropdowns for comparing iterations
 */
export function IterationSelector() {
  const { iterations, selectedComparison, isLoading, hasWorkflow, error, loadIterations, selectComparison } =
    useIterationStore();
  const { currentPR } = usePRStore();

  useEffect(() => {
    if (currentPR) {
      const urlParts = currentPR.htmlUrl.split('/');
      const owner = urlParts[urlParts.length - 4] ?? '';
      const repo = urlParts[urlParts.length - 3] ?? '';
      if (owner && repo) {
        void loadIterations(owner, repo, currentPR.number);
      }
    }
  }, [currentPR, loadIterations]);

  if (isLoading) {
    return (
      <div className="px-4 py-2 text-sm text-gray-500 border-b">
        Loading iterations...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-2 text-sm text-red-600 bg-red-50 border-b">
        {error}
      </div>
    );
  }

  if (iterations.length === 0) {
    return null;
  }

  // AC-3.4.17: Show banner if workflow not installed
  const showWorkflowBanner = !hasWorkflow && iterations.length > 0;

  const leftValue = selectedComparison?.leftIteration ?? 1;
  const rightValue = selectedComparison?.rightIteration ?? iterations.length;

  return (
    <div className="border-b bg-gray-50">
      {showWorkflowBanner && (
        <div className="px-4 py-2 text-sm bg-blue-50 text-blue-800 border-b border-blue-100">
          💡 Install CodjiFlo workflow for force-push resilience and comment tracking.{' '}
          <a
            href="https://github.com/codjiflo/action"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-900"
          >
            Learn more
          </a>
        </div>
      )}
      
      <div className="px-4 py-2 flex items-center gap-4">
        {/* AC-3.5.1, AC-3.5.2: Two dropdowns */}
        <div className="flex items-center gap-2">
          <label htmlFor="compare-from" className="text-sm font-medium text-gray-700">
            Compare from:
          </label>
          <select
            id="compare-from"
            value={leftValue}
            onChange={(e) => selectComparison(Number(e.target.value), rightValue)}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Compare from iteration"
          >
            <option value={0}>Base branch</option>
            {iterations.map((iteration) => (
              <option key={iteration.id} value={iteration.revision}>
                Update {iteration.revision} - {iteration.description.substring(0, 50)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="compare-to" className="text-sm font-medium text-gray-700">
            to:
          </label>
          <select
            id="compare-to"
            value={rightValue}
            onChange={(e) => selectComparison(leftValue, Number(e.target.value))}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Compare to iteration"
          >
            {iterations.map((iteration) => (
              <option key={iteration.id} value={iteration.revision}>
                Update {iteration.revision} - {iteration.description.substring(0, 50)}
              </option>
            ))}
            <option value={iterations.length}>Latest</option>
          </select>
        </div>

        {selectedComparison?.isCrossIteration && (
          <span className="text-xs text-gray-500 italic">
            (Cross-iteration comparison)
          </span>
        )}
      </div>
    </div>
  );
}
