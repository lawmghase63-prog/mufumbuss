import type { PostgrestError } from '@supabase/supabase-js'

export interface PageResult<T> {
  data: T[] | null
  error: PostgrestError | null
}

const PAGE_SIZE = 1000

// PostgREST (Supabase) silently caps rows at 1000 per request, so any table
// that can outgrow that must be fetched page by page.
export async function paginate<T>(
  build: (range: { from: number; to: number }) => Promise<PageResult<T>>,
  pageSize = PAGE_SIZE,
): Promise<PageResult<T>> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await build({ from, to: from + pageSize - 1 })
    if (error) return { data: null, error }
    if (data) out.push(...data)
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return { data: out, error: null }
}