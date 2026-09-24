from pathlib import Path

for name in ['src/components/seo/SiteIcons.astro','public/404.html','src/pages/admin/index.html','scripts/ui/brand-refresh.test.mjs']:
    path=Path(name)
    text=path.read_text()
    assert 'george-g1' in text, f'Expected old icon version in {name}; review source drift'
    path.write_text(text.replace('george-g1','george-ge2').replace('Font-independent G monogram','Font-independent connected Ge signature'))

path=Path('src/styles/icon-actions.css')
text=path.read_text()
assert '.icon-action.back-link' not in text
text += '''
/* Align the visible arrow with the article edge, not the middle of a 44px box.
   Keep the entire touch target inside the page; only the SVG whitespace shifts. */
.icon-action.back-link {
  justify-content: flex-start;
  border-width: 0;
  padding: 0;
  margin-inline: 0;
}
.icon-action.back-link > svg {
  /* arrow-left begins at x=5 in a 24-unit viewBox. */
  transform: translateX(-20.833333%);
}
'''
path.write_text(text)

path=Path('AGENTS.md')
text=path.read_text()
assert 'George G monogram' in text
text=text.replace('George G monogram','connected George Ge signature')
text+='\nKeep favicon backgrounds transparent, preserve connected-letter counters at 16/32px, and regenerate PNG/ICO fallbacks plus versioned links when artwork changes. Back-link arrow ink aligns with the article left edge while retaining the shared 44px touch target.\n'
path.write_text(text)
print('Updated only icon metadata, transparent assets and optical back-link alignment.')
