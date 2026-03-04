import axios from 'axios'
import type { TestApiResponse } from '../types/api'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

export async function getTestMessage(): Promise<TestApiResponse> {
  const { data } = await api.get<TestApiResponse>('/api/test/')
  return data
}
