module.exports = ({ types: t, template }) => ({
  visitor: {
    MemberExpression(path) {
      const { object, property, computed } = path.node;
      if (
        !computed &&
        t.isMetaProperty(object) &&
        t.isIdentifier(object.meta, { name: "import" }) &&
        t.isIdentifier(object.property, { name: "meta" }) &&
        t.isIdentifier(property, { name: "url" })
      ) {
        path.replaceWith(
          template.expression.ast(
            'require("node:url").pathToFileURL(__filename).href',
          ),
        );
      }
    },
  },
});
