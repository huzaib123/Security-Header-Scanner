import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const clean = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Scan', 'History'],
  endpoints: (build) => ({
    // Returns { data, cached, deduplicated? }. 200 = cached, 202 = queued.
    createScan: build.mutation({
      query: (url) => ({ url: '/scans', method: 'POST', body: { url } }),
      invalidatesTags: ['History'],
    }),
    getScan: build.query({
      query: (id) => `/scans/${id}`,
      transformResponse: (res) => res.data,
      providesTags: (result, error, id) => [{ type: 'Scan', id }],
    }),
    getHistory: build.query({
      query: (params = {}) => ({ url: '/scans', params: clean(params) }),
      providesTags: ['History'],
    }),
  }),
});

export function errorMessage(error, fallback = 'Something went wrong') {
  if (!error) return '';
  if (error.status === 'FETCH_ERROR') return 'Cannot reach the server';
  const body = error.data?.error;
  if (body?.details?.length) return body.details.map((d) => d.message).join('. ');
  return body?.message || fallback;
}

export const { useCreateScanMutation, useGetScanQuery, useGetHistoryQuery } = api;
