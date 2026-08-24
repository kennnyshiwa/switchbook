import { notFound } from 'next/navigation'
import CanonicalSwitchShare from '@/components/CanonicalSwitchShare'
import { serializeCanonicalSwitchShare, type ShareSourceKind } from '@/lib/canonical-switch-share'

const validImage = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#ddd6fe"/><rect x="230" y="180" width="340" height="390" rx="50" fill="#7c3aed"/><path d="M310 570h180v90H310z" fill="#4c1d95"/><text x="400" y="395" text-anchor="middle" font-family="sans-serif" font-size="52" fill="white">Switch</text></svg>')

const complete = {
  name: 'Visual Jade', chineseName: '视觉玉轴', manufacturer: 'Switchbook Labs', type: 'TACTILE', technology: 'MAGNETIC',
  compatibility: 'MX-compatible; 3-pin and 5-pin plates', clickType: 'CLICK_JACKET', topHousing: 'Polycarbonate', bottomHousing: 'Nylon', stem: 'POM',
  topHousingColor: 'Crystal Clear', bottomHousingColor: 'Royal Purple', stemColor: 'Jade Green', stemShape: 'Box', markings: 'SBL 2026',
  springWeight: '62', springLength: '20', doubleStage: false, progressiveSpring: true, initialForce: 30, actuationForce: 42,
  tactileForce: 50, bottomOutForce: 62, preTravel: 1.8, tactilePosition: 1.6, bottomOut: 3.5,
  magnetOrientation: 'North', magnetPosition: 'Centered', magnetPolarity: 'N', pcbThickness: '1.6mm', initialMagneticFlux: 35, bottomOutMagneticFlux: 700,
  notes: 'Deterministic local visual fixture. No database or production API is used.', primaryImageId: 'valid', images: [{ id: 'valid', url: validImage }],
}

export default async function VisualQaPage({ searchParams }: { searchParams: Promise<{ source?: string; density?: string; image?: string }> }) {
  if (process.env.SWITCHBOOK_VISUAL_QA !== '1') notFound()
  const query = await searchParams
  const sourceKind: ShareSourceKind = query.source === 'user' ? 'user' : 'master'
  const record = query.density === 'sparse'
    ? { name: 'Sparse Sample', doubleStage: false, images: [] }
    : { ...complete, ...(query.image === 'failover' ? { primaryImageId: 'broken', images: [{ id: 'broken', url: '/visual-qa-intentionally-missing.png' }, { id: 'valid', url: validImage }] } : {}) }
  const contextual = sourceKind === 'user'
    ? { user: { username: 'visual-owner' }, masterSwitchId: 'linked-master', isModified: false, personalTags: ['fixture', 'visual'], personalNotes: 'User-only details stay below canonical statistics.' }
    : { submittedBy: { username: 'visual-submitter' } }
  return <CanonicalSwitchShare share={serializeCanonicalSwitchShare(sourceKind, { ...record, ...contextual })} />
}
