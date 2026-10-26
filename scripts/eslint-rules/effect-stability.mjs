import ts from "typescript";
import { ESLintUtils } from "@typescript-eslint/utils";

/** @param {string} name */
const isEffectModule = (name) => {
  return name === "effect" || name.startsWith("effect/") || name.startsWith("@effect/");
};

/** @param {string} filename */
const isEffectSource = (filename) => {
  return /\/node_modules\/(?:effect\/|@effect\/)/u.test(filename.replaceAll("\\", "/"));
};

/** @param {ts.Node} node @returns {boolean} */
const isInsideGlobalAugmentation = (node) => {
  return (
    (ts.isModuleDeclaration(node) &&
      // eslint-disable-next-line no-bitwise -- TypeScript marks global augmentation with a NodeFlags bit.
      (node.flags & ts.NodeFlags.GlobalAugmentation) !== 0) ||
    (typeof node.parent !== "undefined" && isInsideGlobalAugmentation(node.parent))
  );
};

/** @param {ts.Declaration} declaration */
const isEffectDeclaration = (declaration) => {
  return isEffectSource(declaration.getSourceFile().fileName) && !isInsideGlobalAugmentation(declaration);
};

/** @param {string} name */
const isRestrictedPath = (name) => {
  return /^(?:effect\/(?:process|unstable)(?:\/|$)|@effect\/experimental(?:\/|$)|@effect\/platform-node-shared\/NodeChildProcessSpawner$)/u.test(
    name,
  );
};

/** @param {readonly ts.JSDocTagInfo[]} tags */
const hasUnsupportedTags = (tags) => {
  return tags.some((tag) => {
    return (
      tag.name === "experimental" ||
      (tag.name === "stability" &&
        /\b(?:experimental|unstable)\b/iu.test(
          tag.text
            ?.map((part) => {
              return part.text;
            })
            .join("") ?? "",
        ))
    );
  });
};

/** @param {ts.Declaration} declaration */
const unsupportedModuleDocument = (declaration) => {
  const first = declaration.getSourceFile().statements[0];
  return (
    first &&
    ts.isImportDeclaration(first) &&
    ts.getJSDocTags(first).some((tag) => {
      return (
        tag.tagName.text === "experimental" ||
        (tag.tagName.text === "stability" && typeof tag.comment === "string" && /\b(?:experimental|unstable)\b/iu.test(tag.comment))
      );
    })
  );
};

/** @type {import('@typescript-eslint/utils').TSESLint.RuleModule<'api' | 'commonjs' | 'literal' | 'path' | 'reference', []>} */
const effectStability = {
  // eslint-disable-next-line max-lines-per-function -- The visitor shares one checker and reporting state across its typed handlers.
  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const { program } = services;
    const checker = program.getTypeChecker();
    /** @type {Set<ts.Node>} */
    const reported = new Set();

    /** @param {ts.Node} node @param {'api' | 'commonjs' | 'literal' | 'path' | 'reference'} messageId @param {string} api */
    const report = (node, messageId, api) => {
      const mapped = services.tsNodeToESTreeNodeMap.get(node);
      if (!mapped || reported.has(node)) {
        return;
      }
      reported.add(node);
      context.report({ data: { api }, loc: mapped.loc, messageId });
    };

    /** @param {ts.Symbol} symbol */
    const originalSymbol = (symbol) => {
      // eslint-disable-next-line no-bitwise -- TypeScript represents symbol kinds as bit flags.
      return (symbol.flags & ts.SymbolFlags.Alias) === 0 ? symbol : checker.getAliasedSymbol(symbol);
    };

    /** @param {ts.Symbol} symbol */
    const belongsToEffect = (symbol) => {
      return (
        originalSymbol(symbol)
          .getDeclarations()
          ?.some((declaration) => {
            return isEffectDeclaration(declaration);
          }) ?? false
      );
    };

    /** @param {ts.Symbol} symbol */
    const unsupportedSymbol = (symbol) => {
      const target = originalSymbol(symbol);
      return (
        belongsToEffect(target) &&
        (hasUnsupportedTags(symbol.getJsDocTags(checker)) ||
          hasUnsupportedTags(target.getJsDocTags(checker)) ||
          target.getDeclarations()?.some((declaration) => {
            return unsupportedModuleDocument(declaration);
          }))
      );
    };

    /** @param {ts.Node} node @param {ts.Symbol | undefined} symbol */
    const checkSymbol = (node, symbol) => {
      if (symbol && unsupportedSymbol(symbol)) {
        report(node, "api", originalSymbol(symbol).getName());
      }
    };

    /** @param {ts.Expression} target */
    const checkModule = (target) => {
      if (!ts.isStringLiteralLike(target)) {
        report(target, "literal", "Module loading");
        return;
      }
      const name = target.text;
      if (/(?:^|\/)repos(?:\/|$)/u.test(name.replaceAll("\\", "/"))) {
        report(target, "reference", name);
        return;
      }
      if (isRestrictedPath(name)) {
        report(target, "path", name);
        return;
      }
      if (!isEffectModule(name)) {
        return;
      }
      const symbol = checker.getSymbolAtLocation(target);
      if (!symbol) {
        return;
      }
      checkSymbol(target, symbol);
    };

    /** @param {ts.Expression} expression */
    const isRequire = (expression) => {
      return (
        (ts.isIdentifier(expression) && expression.text === "require") || checker.getTypeAtLocation(expression).getSymbol()?.getName() === "Require"
      );
    };

    /** @param {ts.ImportDeclaration | ts.ExportDeclaration} node */
    const checkModuleDeclaration = (node) => {
      if (!node.moduleSpecifier) {
        return;
      }
      checkModule(node.moduleSpecifier);
      if (!ts.isExportDeclaration(node) || node.exportClause) {
        return;
      }
      const moduleSymbol = checker.getSymbolAtLocation(node.moduleSpecifier);
      const unsupported =
        moduleSymbol &&
        checker.getExportsOfModule(moduleSymbol).find((symbol) => {
          return unsupportedSymbol(symbol);
        });
      if (unsupported) {
        report(node.moduleSpecifier, "api", unsupported.getName());
      }
    };

    /** @param {ts.CallExpression} node */
    const checkModuleCall = (node) => {
      if (node.expression.kind !== ts.SyntaxKind.ImportKeyword && !isRequire(node.expression)) {
        return;
      }
      const target = node.arguments[0];
      if (!target) {
        return;
      }
      checkModule(target);
      if (isRequire(node.expression) && ts.isStringLiteralLike(target) && isEffectModule(target.text)) {
        report(target, "commonjs", target.text);
      }
    };

    /** @param {ts.Node} node */
    const checkLoading = (node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        checkModuleDeclaration(node);
      }
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
        checkModule(node.argument.literal);
      }
      if (ts.isCallExpression(node)) {
        checkModuleCall(node);
      }
    };

    /** @param {ts.BindingElement} node */
    const checkBinding = (node) => {
      if (!ts.isObjectBindingPattern(node.parent) || !ts.isVariableDeclaration(node.parent.parent) || !node.parent.parent.initializer) {
        return;
      }
      const key = node.propertyName ?? node.name;
      if (ts.isIdentifier(key) || ts.isStringLiteralLike(key)) {
        checkSymbol(node, checker.getTypeAtLocation(node.parent.parent.initializer).getProperty(key.text));
      }
    };

    /** @param {ts.ElementAccessExpression} node */
    const checkElementAccess = (node) => {
      const objectType = checker.getTypeAtLocation(node.expression);
      const objectSymbol = objectType.getSymbol();
      const key = node.argumentExpression;
      if (ts.isStringLiteralLike(key)) {
        checkSymbol(node, objectType.getProperty(key.text));
      } else if (
        objectSymbol &&
        belongsToEffect(objectSymbol) &&
        originalSymbol(objectSymbol)
          .getDeclarations()
          ?.some((declaration) => {
            return ts.isSourceFile(declaration) || ts.isModuleDeclaration(declaration);
          })
      ) {
        report(key, "literal", "Effect member access");
      }
    };

    /** @param {ts.Node} node */
    const checkAccess = (node) => {
      if (ts.isBindingElement(node)) {
        checkBinding(node);
      }
      if (ts.isIdentifier(node) && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) {
        checkSymbol(node, checker.getSymbolAtLocation(node));
      }
      if (ts.isPropertyAccessExpression(node)) {
        checkSymbol(node, checker.getSymbolAtLocation(node.name));
      }
      if (ts.isElementAccessExpression(node)) {
        checkElementAccess(node);
      }
    };

    /** @param {ts.Node} node */
    const visit = (node) => {
      checkLoading(node);
      checkAccess(node);
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
      description: "Require statically reviewable, public stable Effect APIs and installed-package imports.",
    },
    messages: {
      api: "{{api}} is annotated unstable or experimental. Use a public stable API; process execution belongs in tests/helpers/node-command.ts.",
      commonjs: "{{api}} loses symbol types through CommonJS loading. Use a typed ESM import so Effect API stability can be checked.",
      literal:
        "{{api}} must use a literal target so Effect API stability can be reviewed statically. Runtime indirection is not verified by this rule.",
      path: "{{api}} is not a supported stable Effect import. Use public stable APIs and the native Node command adapter.",
      reference: "{{api}} imports a read-only source reference. Resolve application imports through installed packages instead of repos/.",
    },
    schema: [],
    type: "problem",
  },
};

export { effectStability };
