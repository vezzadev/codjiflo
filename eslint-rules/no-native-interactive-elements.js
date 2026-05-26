const REPLACEMENTS = {
  button: "Use <Button> from '@/components' (react-aria-components)",
  input:
    "Use react-aria-components' <Input> inside a <TextField>, or <SearchField>+<Input> for search",
  textarea:
    "Use react-aria-components' <TextArea> inside a <TextField>, re-exported from '@/components/ui'",
  select:
    "Use react-aria-components' <Select>+<ListBox>+<Popover> via '@/components/ui'",
  dialog: "Use <Modal> from '@/components/ui' (wraps react-aria-components' Dialog/ModalOverlay/Modal)",
};

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Ban raw native interactive HTML elements; require react-aria-components primitives instead",
      recommended: false,
    },
    schema: [],
    messages: {
      banned: "Raw <{{tag}}> is not allowed here. {{replacement}}.",
    },
  },

  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier") return;
        const tag = node.name.name;
        if (!Object.prototype.hasOwnProperty.call(REPLACEMENTS, tag)) return;

        context.report({
          node: node.name,
          messageId: "banned",
          data: { tag, replacement: REPLACEMENTS[tag] },
        });
      },
    };
  },
};

export default rule;
