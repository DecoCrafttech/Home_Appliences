import { describe, expect, it } from "vitest";
import { sanitizeCatalogueSvg } from "./catalogueMedia.js";
describe("static catalogue SVG validation", () => {
    it("adds the SVG namespace needed when an icon is served as an image", () => {
        const clean = sanitizeCatalogueSvg('<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>');
        expect(clean).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(clean).toContain('viewBox="0 0 24 24"');
    });
    it("preserves standard static stroke and sizing attributes", () => {
        const clean = sanitizeCatalogueSvg('<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet"><path stroke="currentColor" stroke-dasharray="2 3" stroke-miterlimit="10" vector-effect="non-scaling-stroke" d="M0 0L24 24"/></svg>');
        expect(clean).toContain('stroke-dasharray="2 3"');
        expect(clean).toContain('preserveAspectRatio="xMidYMid meet"');
    });
    it("preserves safe geometry and case-sensitive viewBox attributes", () => {
        const clean = sanitizeCatalogueSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#2563eb" d="M0 0h24v24H0z"/></svg>');
        expect(clean).toContain('viewBox="0 0 24 24"');
        expect(clean).toContain('fill="#2563eb"');
    });
    it.each([
        "<svg><script>alert(1)</script></svg>",
        '<svg onload="alert(1)"><path d="M0 0"/></svg>',
        '<svg xmlns="https://example.com/invalid"><path d="M0 0"/></svg>',
        "<svg><foreignObject><div>unsafe</div></foreignObject></svg>",
        '<svg><image href="https://example.com/image.png"/></svg>',
        '<svg><path fill="url(https://example.com/a)" d="M0 0"/></svg>',
        '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>',
        '<svg><a href="javascript:alert(1)">link</a></svg>',
        '<svg><path style="fill:url(https://example.com)"/></svg>',
    ])("rejects executable or externally referenced content: %s", (source) => expect(() => sanitizeCatalogueSvg(source)).toThrow());
});
