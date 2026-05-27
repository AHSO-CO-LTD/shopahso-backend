import sanitizeHtml from 'sanitize-html';

const ALLOWED_CLASSES = {
  p: ['text-left', 'text-center', 'text-right', 'image-row'],
  h1: ['text-left', 'text-center', 'text-right'],
  h2: ['text-left', 'text-center', 'text-right'],
  h3: ['text-left', 'text-center', 'text-right'],
  div: [
    'related-product-link',
    'text-left',
    'text-center',
    'text-right',
    'image-row',
  ],
  span: ['related-product-label'],
  a: ['product-link', 'related-product-anchor'],
  img: [
    'description-image',
    'image-align-left',
    'image-align-center',
    'image-align-right',
    'image-size-small',
    'image-size-medium',
    'image-size-large',
    'image-size-full',
  ],
};

const CSS_LENGTH = /^(auto|(?:[1-9]\d{0,2}|1\d{3}|2000)px|(?:[1-9]\d?|100)%)$/;
const CSS_SPACING = /^(auto|0|(?:[1-9]\d{0,2}|1000)px)$/;

export function sanitizeProductDescriptionHtml(html?: string | null) {
  if (!html) {
    return html ?? null;
  }

  const sanitized = sanitizeHtml(html, {
    allowedTags: [
      'p',
      'h1',
      'h2',
      'h3',
      'strong',
      'em',
      'u',
      'ul',
      'ol',
      'li',
      'img',
      'a',
      'div',
      'span',
      'br',
    ],
    allowedAttributes: {
      p: ['class', 'style'],
      h1: ['class', 'style'],
      h2: ['class', 'style'],
      h3: ['class', 'style'],
      a: ['href', 'target', 'rel', 'class'],
      img: ['src', 'alt', 'width', 'height', 'class', 'style'],
      div: ['class', 'style'],
      span: ['class'],
    },
    allowedClasses: ALLOWED_CLASSES,
    allowedStyles: {
      p: {
        'text-align': [/^(left|center|right)$/],
      },
      h1: {
        'text-align': [/^(left|center|right)$/],
      },
      h2: {
        'text-align': [/^(left|center|right)$/],
      },
      h3: {
        'text-align': [/^(left|center|right)$/],
      },
      div: {
        'text-align': [/^(left|center|right)$/],
      },
      img: {
        width: [CSS_LENGTH],
        'max-width': [CSS_LENGTH],
        height: [CSS_LENGTH],
        display: [/^(block|inline|inline-block)$/],
        'margin-left': [CSS_SPACING],
        'margin-right': [CSS_SPACING],
        float: [/^(left|right|none)$/],
        'object-fit': [/^(contain|cover)$/],
      },
    },
    allowedSchemes: ['http', 'https'],
    allowedSchemesByTag: {
      a: ['http', 'https'],
      img: ['http', 'https'],
    },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => {
        const href = attribs.href ?? '';
        const isInternalLink = href.startsWith('/');
        const nextAttribs = href
          ? {
              ...attribs,
              href,
            }
          : { ...attribs };

        return {
          tagName: 'a',
          attribs: {
            ...nextAttribs,
            ...(isInternalLink || !href
              ? {}
              : {
                  target: attribs.target ?? '_blank',
                  rel: 'noopener noreferrer',
                }),
          },
        };
      },
    },
  });

  return sanitized.trim() || null;
}
