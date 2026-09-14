import { siteContent } from '@/data/siteContent';

export function ClassroomCaption({ preview=false }: { preview?: boolean }) {
  const Tag=preview?'p':'h2';
  return <div className={`classroom-caption${preview?' journey-classroom-caption':''}`} aria-hidden={preview||undefined}>
    <Tag className="section-heading" id={preview?undefined:'audience-heading'}>{siteContent.audience.label}</Tag>
    <p className="classroom-headline">{siteContent.audience.headline.map(line=><span key={line}>{line}</span>)}</p>
    <p className="classroom-intro">{siteContent.audience.intro}</p>
  </div>;
}
