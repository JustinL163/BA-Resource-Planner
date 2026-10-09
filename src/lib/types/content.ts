export type ContentNode =
  | { type: 'text'; text: string }
  | {
      type: 'element';
      tag: 'div' | 'h2' | 'h3' | 'h4' | 'p' | 'ul' | 'ol' | 'li' | 'br' | 'a' |
        'strong' | 'b' | 'em' | 'i' | 'span' | 'code';
      attributes: {
        class?: string;
        href?: string;
        target?: string;
        rel?: string;
        style?: string;
      };
      children: ContentNode[];
    };

export interface StaticDocument {
  title: string;
  content: ContentNode[];
}
