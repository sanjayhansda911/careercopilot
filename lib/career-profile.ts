export const initialCareerProfile = {
  target_track: 'product_management',
  total_experience_years: 9,
  current_title: 'Digital Project Manager',
  current_company: 'Sonata Software',
  current_domain: 'Microsoft Partner Center Technical Support / CSP operations',
  target_roles: ['Associate Product Manager','Product Manager','Product Operations Manager','Platform Product Manager','Partner Experience Product Manager'],
  target_domains: ['B2B SaaS','Cloud platforms','Partner ecosystems','Enterprise AI'],
  preferred_locations: ['Hyderabad','India Remote','Bengaluru'],
  target_ctc_min_lpa: 22,
  target_ctc_max_lpa: 28,
  notice_period_days: 90,
  skills: ['Customer problem discovery','JTBD','Problem framing','PRDs','MVP scoping','RICE fundamentals','Product analytics','API workflows','Generative AI','LLMs','RAG','Prompt engineering','Stakeholder management'],
  projects: [
    {name:'PMCoach.ai',description:'AI PM interview coach with real-time voice mock interviews; built using Gemini Live API, Next.js, Supabase and Vercel.'},
    {name:'Nagrik',description:'Civic grievance routing app covering eight civic categories across seven metros; React Native, Expo and Firebase.'}
  ]
} as const;
