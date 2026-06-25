import axios from 'axios';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

export const adminApi = axios.create({ baseURL: API_BASE, timeout: 15000 });

// 注入 token
adminApi.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminApi.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('admin_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export const providerApi = {
  list:   () => adminApi.get('/admin/providers').then(r => r.data.data),
  create: (data: any) => adminApi.post('/admin/providers', data).then(r => r.data),
  update: (id: string, data: any) => adminApi.patch(`/admin/providers/${id}`, data).then(r => r.data),
  delete: (id: string) => adminApi.delete(`/admin/providers/${id}`).then(r => r.data),
  test:   (id: string) => adminApi.post(`/admin/providers/${id}/test`).then(r => r.data),
};

export const settingsApi = {
  list:        () => adminApi.get('/admin/settings').then(r => r.data.data),
  update:      (key: string, value: string) => adminApi.patch(`/admin/settings/${key}`, { value }).then(r => r.data),
  batchUpdate: (updates: { key: string; value: string }[]) => adminApi.post('/admin/settings/batch', { updates }).then(r => r.data),
};

export const promptApi = {
  list:     () => adminApi.get('/admin/prompts').then(r => r.data.data),
  get:      (id: string) => adminApi.get(`/admin/prompts/${id}`).then(r => r.data.data),
  create:   (data: any) => adminApi.post('/admin/prompts', data).then(r => r.data),
  activate: (id: string) => adminApi.post(`/admin/prompts/${id}/activate`).then(r => r.data),
};

export const usersApi = {
  list:       (params?: any) => adminApi.get('/admin/users', { params }).then(r => r.data),
  updateRole: (id: string, role: string) => adminApi.patch(`/admin/users/${id}/role`, { role }).then(r => r.data),
};

export const dashboardApi = {
  overview: () => adminApi.get('/admin/dashboard').then(r => r.data.data),
  usage:    (days?: number) => adminApi.get('/admin/usage/stats', { params: { days } }).then(r => r.data.data),
};

export const authApi = {
  login: (email: string, password: string) =>
    adminApi.post('/auth/login', { email, password }).then(r => r.data.data),
};

