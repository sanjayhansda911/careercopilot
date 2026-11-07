import Link from 'next/link';
const cards = [
  {label:'Profile readiness',value:'Needs setup',detail:'Add and verify career facts'},
  {label:'Jobs discovered',value:'—',detail:'Connect sources to begin'},
  {label:'Strong matches',value:'—',detail:'80+ fit score'},
  {label:'Applications',value:'0',detail:'Human approval required'}
];
export default function Home(){return <main className="mx-auto max-w-6xl p-8">
  <header className="flex items-center justify-between"><div><p className="text-sm font-semibold text-blue-700">CAREERPILOT</p><h1 className="mt-2 text-3xl font-bold">Your career intelligence workspace</h1><p className="mt-2 text-slate-600">Discover relevant roles, understand your fit and prepare better applications.</p></div><span className="rounded-full bg-blue-50 px-4 py-2 text-sm text-blue-800">MVP · Profile-first</span></header>
  <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(c=><article key={c.label} className="rounded-xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{c.label}</p><p className="mt-3 text-2xl font-semibold">{c.value}</p><p className="mt-2 text-sm text-slate-500">{c.detail}</p></article>)}</section>
  <section className="mt-8 grid gap-5 lg:grid-cols-3"><article className="rounded-xl border bg-white p-6 lg:col-span-2"><h2 className="text-xl font-semibold">First milestone: verify your career profile</h2><p className="mt-2 text-slate-600">CareerPilot will use your PM resume as its initial source. Every generated claim should trace back to a verified fact before it appears in an application.</p><ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700"><li>Review role history and dates</li><li>Verify metrics such as team size, backlog reduction and CSAT</li><li>Separate direct product ownership from transferable product experience</li><li>Confirm project details and live links</li></ul><Link className="mt-5 inline-block rounded-lg bg-blue-700 px-4 py-2 text-white" href="/dashboard">Open workspace</Link></article>
  <article className="rounded-xl border bg-white p-6"><h2 className="text-lg font-semibold">Your initial search focus</h2><p className="mt-3 text-sm text-slate-600">Product Management · Enterprise SaaS · Partner platforms · Cloud ecosystems · AI products</p><div className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No jobs will be submitted automatically. You approve every application.</div></article></section>
</main>}
