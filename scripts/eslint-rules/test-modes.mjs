import ts from "typescript";
import { ESLintUtils } from "@typescript-eslint/utils";

/** @type {import('@typescript-eslint/utils').TSESLint.RuleModule<'disabled' | 'focused', []>} */
const testModes = {
  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    /** @param {ts.Expression} expression @returns {boolean} */
    const isTestApi = (expression) => {
      const type = checker.getTypeAtLocation(expression);
      const known = ["only", "skip", "each"].every((name) =>
        type
          .getProperty(name)
          ?.getDeclarations()
          ?.some((declaration) =>
            /\/node_modules\/(?:@effect\/vitest\/|vitest\/|@vitest\/runner\/)/.test(
              declaration.getSourceFile().fileName.replaceAll("\\", "/"),
            ),
          ),
      );
      return (
        known ||
        ((ts.isPropertyAccessExpression(expression) ||
          ts.isElementAccessExpression(expression) ||
          ts.isCallExpression(expression)) &&
          isTestApi(expression.expression))
      );
    };
    /** @param {ts.Node} node @param {string} name */
    const report = (node, name) => {
      const mapped = services.tsNodeToESTreeNodeMap.get(node);
      if (mapped)
        context.report({
          loc: mapped.loc,
          messageId: name === "only" ? "focused" : "disabled",
        });
    };
    /** @param {ts.Node} node */
    const visit = (node) => {
      if (
        ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)
      ) {
        const key = ts.isPropertyAccessExpression(node)
          ? node.name
          : node.argumentExpression;
        if (
          (ts.isIdentifier(key) || ts.isStringLiteralLike(key)) &&
          ["only", "runIf", "skip", "skipIf", "todo"].includes(key.text) &&
          isTestApi(node.expression)
        )
          report(key, key.text);
      }
      if (ts.isCallExpression(node) && isTestApi(node.expression)) {
        node.arguments
          .filter((argument) => ts.isObjectLiteralExpression(argument))
          .flatMap((argument) => argument.properties)
          .filter((property) => ts.isPropertyAssignment(property))
          .filter(
            (property) =>
              property.initializer.kind !== ts.SyntaxKind.FalseKeyword,
          )
          .map((property) => {
            const key = property.name;
            if (
              (ts.isIdentifier(key) || ts.isStringLiteralLike(key)) &&
              ["only", "skip", "todo"].includes(key.text)
            )
              report(key, key.text);
            return property;
          });
      }
      ts.forEachChild(node, visit);
    };
    return {
      Program(ast) {
        visit(services.esTreeNodeToTSNodeMap.get(ast));
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description:
        "Check typed Vitest and Effect test modes, including aliases and layer helpers.",
    },
    messages: {
      disabled:
        "Disabled or conditional tests require a local, explained rule exception. Keep ordinary validation's coverage intact.",
      focused:
        "Focused tests prevent full-suite coverage. Use explicit file or name filtering during development.",
    },
    schema: [],
    type: "problem",
  },
};

export { testModes };
