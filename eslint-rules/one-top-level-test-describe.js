export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require exactly one top-level test.describe() block in E2E test files",
      recommended: false,
    },
    schema: [
      {
        type: "object",
        properties: {
          filePattern: {
            type: "string",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missing:
        "E2E test file must contain exactly one top-level test.describe() block (found none).",
      multiple:
        "E2E test file must contain exactly one top-level test.describe() block (found {{count}}).",
      nested:
        "test.describe() must be declared at the top level, not nested inside another block.",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const filePatternString = options.filePattern || "\\.e2e\\.(ts|js)$";
    const filePattern = new RegExp(filePatternString);

    const filename = context.getFilename();
    if (!filePattern.test(filename)) {
      return {};
    }

    let topLevelDescribeCount = 0;

    function isTestDescribe(node) {
      return (
        node.callee &&
        node.callee.type === "MemberExpression" &&
        node.callee.object.type === "Identifier" &&
        node.callee.object.name === "test" &&
        node.callee.property.type === "Identifier" &&
        node.callee.property.name === "describe"
      );
    }

    return {
      CallExpression(node) {
        if (!isTestDescribe(node)) return;

        const parent = node.parent;
        const isTopLevel =
          parent.type === "ExpressionStatement" &&
          parent.parent.type === "Program";

        if (isTopLevel) {
          topLevelDescribeCount++;
        } else {
          context.report({
            node,
            messageId: "nested",
          });
        }
      },

      "Program:exit"(node) {
        if (topLevelDescribeCount === 0) {
          context.report({
            node,
            messageId: "missing",
          });
        } else if (topLevelDescribeCount > 1) {
          context.report({
            node,
            messageId: "multiple",
            data: { count: topLevelDescribeCount },
          });
        }
      },
    };
  },
};
