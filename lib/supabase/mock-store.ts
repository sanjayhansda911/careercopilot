import { initialCareerProfile } from '../career-profile';

// In-memory table stores for local development and offline testing
const tables: Record<string, any[]> = {
  career_profiles: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      user_id: '00000000-0000-0000-0000-000000000001',
      ...initialCareerProfile,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  career_facts: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      user_id: '00000000-0000-0000-0000-000000000001',
      category: 'experience',
      fact: 'Digital Project Manager at Sonata Software Ltd, supporting Microsoft Partner Center Technical Support across APAC and North America.',
      verification_status: 'verified',
      allowed_resume_tracks: ['product_management'],
      created_at: new Date().toISOString()
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      user_id: '00000000-0000-0000-0000-000000000001',
      category: 'leadership',
      fact: 'Led a 23-member technical operations team.',
      verification_status: 'verified',
      allowed_resume_tracks: ['product_management'],
      created_at: new Date().toISOString()
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      user_id: '00000000-0000-0000-0000-000000000001',
      category: 'impact',
      fact: 'Reduced open backlog by 40% through operational improvements and dependency management.',
      verification_status: 'verified',
      allowed_resume_tracks: ['product_management'],
      created_at: new Date().toISOString()
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      user_id: '00000000-0000-0000-0000-000000000001',
      category: 'project',
      fact: 'PMCoach.ai: solo 0-to-1 AI PM interview coach with voice mocks using Gemini Live API, Next.js, and Supabase.',
      verification_status: 'verified',
      allowed_resume_tracks: ['product_management'],
      created_at: new Date().toISOString()
    }
  ],
  jobs: [
    {
      id: 'j-001',
      title: 'Senior Product Manager, Developer Platform',
      company: 'Acme SaaS Corp',
      location: 'Bengaluru (Hybrid)',
      work_mode: 'hybrid',
      job_url: 'https://careers.acme.com/jobs/spm',
      canonical_url: 'https://careers.acme.com/jobs/spm',
      description: 'We are seeking a Senior Product Manager to lead our developer platform and API partner ecosystem. Responsibilities include customer problem discovery, writing PRDs, and roadmap execution. 5+ years B2B SaaS required.',
      salary_min_lpa: 24,
      salary_max_lpa: 28,
      salary_currency: 'INR',
      salary_confidence: 'advertised',
      status: 'open',
      is_active: true,
      posted_at: new Date().toISOString(),
      discovered_at: new Date().toISOString()
    },
    {
      id: 'j-002',
      title: 'Product Operations Manager',
      company: 'CloudFlow Tech',
      location: 'India Remote',
      work_mode: 'remote',
      job_url: 'https://careers.cloudflow.io/jobs/pm-ops',
      canonical_url: 'https://careers.cloudflow.io/jobs/pm-ops',
      description: 'Lead operational improvements, incident management, and partner enablement workflows for our high-scale enterprise cloud product.',
      salary_min_lpa: 20,
      salary_max_lpa: 26,
      salary_currency: 'INR',
      salary_confidence: 'advertised',
      status: 'open',
      is_active: true,
      posted_at: new Date().toISOString(),
      discovered_at: new Date().toISOString()
    }
  ],
  job_matches: [],
  resumes: [],
  application_documents: [],
  applications: [],
  notifications: [],
  search_runs: [],
  agent_runs: [],
  audit_logs: []
};

class MockQueryBuilder {
  private tableName: string;
  private filters: Array<(item: any) => boolean> = [];
  private limitCount?: number;
  private orderCol?: string;
  private orderAsc = true;
  private mutationResult: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
    if (!tables[tableName]) {
      tables[tableName] = [];
    }
  }

  select(_fields = '*', options?: { count?: string; head?: boolean }) {
    if (options?.head) {
      return Promise.resolve({
        data: null,
        count: tables[this.tableName].length,
        error: null
      });
    }
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push(item => item[col] === val);
    return this;
  }

  gte(col: string, val: any) {
    this.filters.push(item => (item[col] ?? 0) >= val);
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  insert(record: any) {
    const list = tables[this.tableName];
    const newItems = Array.isArray(record) ? record : [record];
    const inserted = newItems.map(item => ({
      id: item.id || crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...item
    }));
    list.push(...inserted);
    this.mutationResult = Array.isArray(record) ? inserted : inserted[0];
    return this;
  }

  upsert(record: any, options?: { onConflict?: string }) {
    const list = tables[this.tableName];
    const newItems = Array.isArray(record) ? record : [record];
    const results: any[] = [];

    for (const item of newItems) {
      let existingIndex = -1;
      if (options?.onConflict) {
        const conflictKeys = options.onConflict.split(',').map(k => k.trim());
        existingIndex = list.findIndex(existing =>
          conflictKeys.every(k => existing[k] === item[k])
        );
      } else if (item.id) {
        existingIndex = list.findIndex(existing => existing.id === item.id);
      }

      if (existingIndex !== -1) {
        list[existingIndex] = { ...list[existingIndex], ...item, updated_at: new Date().toISOString() };
        results.push(list[existingIndex]);
      } else {
        const inserted = { id: item.id || crypto.randomUUID(), created_at: new Date().toISOString(), ...item };
        list.push(inserted);
        results.push(inserted);
      }
    }

    this.mutationResult = Array.isArray(record) ? results : results[0];
    return this;
  }

  update(patch: any) {
    const list = tables[this.tableName];
    let lastUpdated: any = null;

    for (let i = 0; i < list.length; i++) {
      if (this.filters.every(fn => fn(list[i]))) {
        list[i] = { ...list[i], ...patch, updated_at: new Date().toISOString() };
        lastUpdated = list[i];
      }
    }

    this.mutationResult = lastUpdated;
    return this;
  }

  delete() {
    const list = tables[this.tableName];
    tables[this.tableName] = list.filter(item => !this.filters.every(fn => fn(item)));
    this.mutationResult = [];
    return this;
  }

  private execute() {
    if (this.mutationResult !== null) {
      return this.mutationResult;
    }

    let list = tables[this.tableName] || [];
    for (const fn of this.filters) {
      list = list.filter(fn);
    }
    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.orderAsc;
      list = [...list].sort((a, b) => {
        if (a[col] < b[col]) return asc ? -1 : 1;
        if (a[col] > b[col]) return asc ? 1 : -1;
        return 0;
      });
    }
    if (this.limitCount !== undefined) {
      list = list.slice(0, this.limitCount);
    }
    return list;
  }

  async single() {
    const res = this.execute();
    const item = Array.isArray(res) ? res[0] : res;
    return { data: item || null, error: item ? null : { message: 'Row not found' } };
  }

  async maybeSingle() {
    const res = this.execute();
    const item = Array.isArray(res) ? res[0] : res;
    return { data: item || null, error: null };
  }

  then(resolve: (value: any) => void) {
    const res = this.execute();
    if (this.mutationResult !== null) {
      resolve({ data: this.mutationResult, error: null });
    } else {
      resolve({ data: res, count: Array.isArray(res) ? res.length : 1, error: null });
    }
  }
}

export function createMockSupabaseClient() {
  return {
    from(tableName: string) {
      return new MockQueryBuilder(tableName);
    },
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'local-dev@careerpilot.app'
          }
        },
        error: null
      }),
      signOut: async () => ({ error: null })
    }
  };
}
