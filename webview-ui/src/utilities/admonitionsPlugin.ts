import { visit } from 'unist-util-visit'
//=================================
/**
 * Plugin to generate callout cells.
 */
/** @type {import('unified').Plugin<void[], Root>}*/
const admonitionsPlugin = () =>
    (tree) =>
        visit(tree,
            (node) =>
                (node.type === 'containerDirective')
                    ? (() => {
                        const data = node.data || (node.data = {});
                        const title =
                            node.name.replace('sharp', '#').toUpperCase();
                        data.hName = 'div';
                        data.hProperties = {
                            className: `admonition admonition-${node.name}`,
                        };
                        node.children.unshift({
                            type: 'paragraph',
                            data: {
                                hProperties: {
                                    className: 'admonition-title',
                                },
                            },
                            children: [{ type: 'text', value: title }],
                        });
                    })()
                    : undefined
        );

export { admonitionsPlugin }