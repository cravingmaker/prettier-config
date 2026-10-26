import ts from "typescript";
import { ESLintUtils } from "@typescript-eslint/utils";

/** @type {import('@typescript-eslint/utils').TSESLint.RuleModule<'disabled' | 'focused', []>} */
const testModes = {
  // eslint-disable-next-line max-lines-per-function -- Test API recognition and diagnostics share the file's typed parser services.
  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    /** @param {ts.Expression} expression @returns {boolean} */
    const isTestApi = (expression) => {
      const type = checker.getTypeAtLocation(expression);
      const isKnownTestApi = ["only", "skip", "each"].every((name) => {
        return type
          .getProperty(name)
          ?.getDeclarations()
          ?.some((declaration) => {
            return /\/node_modules\/(?:@effect\/vitest\/|vitest\/|@vitest\/runner\/)/u.test(
              declaration.getSourceFile().fileName.replaceAll("\\", "/"),
            );
          });
      });
      const hasTarget = ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression) || ts.isCallExpression(expression);
      return isKnownTestApi || (hasTarget && isTestApi(expression.expression));
    };

    /** @param {ts.Node} node @param {string} name */
    const report = (node, name) => {
      const mapped = services.tsNodeToESTreeNodeMap.get(node);
      if (mapped) {
        context.report({
          loc: mapped.loc,
          messageId: name === "only" ? "focused" : "disabled",
        });
      }
    };

    /** @param {ts.ObjectLiteralElementLike} option */
    const checkOption = (option) => {
      if (!ts.isPropertyAssignment(option) || option.initializer.kind === ts.SyntaxKind.FalseKeyword) {
        return;
      }
      const key = option.name;
      if ((ts.isIdentifier(key) || ts.isStringLiteralLike(key)) && ["only", "skip", "todo"].includes(key.text)) {
        report(key, key.text);
      }
    };

    /** @param {ts.CallExpression} node */
    const checkOptions = (node) => {
      if (!isTestApi(node.expression)) {
        return;
      }
      // eslint-disable-next-line functional/no-loop-statements -- Visit test arguments for diagnostics without creating unused intermediate arrays.
      for (const argument of node.arguments) {
        if (!ts.isObjectLiteralExpression(argument)) {
          continue;
        }
        // eslint-disable-next-line functional/no-loop-statements -- Check each option in source order, reporting every accidental mode.
        for (const option of argument.properties) {
          checkOption(option);
        }
      }
    };

    /** @param {ts.Node} node */
    const visit = (node) => {
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const key = ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression;
        if (
          (ts.isIdentifier(key) || ts.isStringLiteralLike(key)) &&
          ["only", "runIf", "skip", "skipIf", "todo"].includes(key.text) &&
          isTestApi(node.expression)
        ) {
          report(key, key.text);
        }
      }
      if (ts.isCallExpression(node)) {
        checkOptions(node);
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
      description: "Check typed Vitest and Effect test modes, including aliases and layer helpers.",
    },
    messages: {
      disabled: "Disabled or conditional tests require a local, explained rule exception. Keep ordinary validation's coverage intact.",
      focused: "Focused tests prevent full-suite coverage. Use explicit file or name filtering during development.",
    },
    schema: [],
    type: "problem",
  },
};

export { testModes };
