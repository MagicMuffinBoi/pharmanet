# Export verification

Verified locally on 2026-11-06:

- Next.js 16.3.4 production build passed, including a build with Node.js 22.23.4.
- TypeScript strict checking passed.
- Production homepage returned HTTP 200.
- Literature route returned 12 indexed records.
- PubChem exact lookup resolved modafinil to CID 4236.
- openFDA label route returned three modafinil label records.
- Invalid short lookup and label requests returned HTTP 400.
- Browser check confirmed `mk677` finds Ibutamoren and opens the structured side-effects panel with source links.
- Browser console contained no errors during those checks.

Live API checks are point-in-time checks. Upstream datasets, availability, and rate limits can change. These checks verify the migration's behavior; they do not independently validate every clinical claim.
