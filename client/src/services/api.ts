import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore, type User } from '../store/authStore';

interface QueueItem {
  resolve: (token: string) => void;
  reject: (error: AxiosError) => void;
}

interface RefreshResponseData {
  data: {
    accessToken: string;
    user: User;
  };
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor - handle token refresh
// State is encapsulated in a closure to avoid module-level mutable variables
const setupRefreshInterceptor = () => {
  let isRefreshing = false;
  let failedQueue: QueueItem[] = [];

  const processQueue = (error: AxiosError | null, token: string | null = null): void => {
    failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token!);
      }
    });
    failedQueue = [];
  };

  api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const response = await axios.post<RefreshResponseData>(
            `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/refresh`,
            {},
            { withCredentials: true }
          );

          const { accessToken, user } = response.data.data;
          useAuthStore.getState().login(user, accessToken);

          processQueue(null, accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError as AxiosError, null);
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    }
  );
};

setupRefreshInterceptor();

export default api;
