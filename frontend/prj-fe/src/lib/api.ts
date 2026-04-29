const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
let refreshInFlight: Promise<boolean> | null = null;

interface ApiErrorBody {
  detail?: string;
  message?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  dob: string;
  gender: boolean;
  avatar?: string;
  major?: string;
  english_level?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token?: string;
  token_type?: string;
  message?: string;
}

export interface UserResponse {
  id?: string;
  user_id?: string;
  email?: string;
  full_name?: string;
  dob?: string;
  gender?: boolean;
  avatar?: string;
  major?: string;
  english_level?: string;
  role?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UpdateMePayload {
  full_name?: string;
  major?: string;
  dob?: string;
  gender?: boolean;
  avatar?: string;
  english_level?: string;
}

const tryReadErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as ApiErrorBody;
    if (typeof payload.detail === "string" && payload.detail.length > 0) {
      return payload.detail;
    }

    if (typeof payload.message === "string" && payload.message.length > 0) {
      return payload.message;
    }

    return `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

const refreshAccessToken = async (): Promise<boolean> => {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
};

const requestJson = async <T>(
  path: string,
  init: RequestInit,
  allowRefresh = true
): Promise<T> => {
  const performFetch = () =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

  let response = await performFetch();

  if (response.status === 401 && allowRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await performFetch();
    }
  }

  if (!response.ok) {
    const message = await tryReadErrorMessage(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
};

export const register = async (payload: RegisterPayload): Promise<UserResponse> => {
  return requestJson<UserResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const login = async (payload: LoginPayload): Promise<TokenResponse> => {
  return requestJson<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const getMe = async (): Promise<UserResponse> => {
  return requestJson<UserResponse>("/api/auth/me", {
    method: "GET",
  });
};

export const updateMe = async (payload: UpdateMePayload): Promise<UserResponse> => {
  return requestJson<UserResponse>("/api/users/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const getUserById = async (userId: string): Promise<UserResponse> => {
  return requestJson<UserResponse>(`/api/users/${userId}`, {
    method: "GET",
  });
};

export const logout = async (): Promise<void> => {
  return requestJson<void>("/api/auth/logout", {
    method: "POST",
  });
};

export interface VocabStats {
  status: string;
  data: {
    total_words: number;
    learning: number;
    mastered: number;
    unseen: number;
    streak: number;
  };
}

export interface VocabItem {
  word: string;
  status: string;
  specialization?: string;
  difficulty?: string;
  context?: string;
  translation?: string;
  next_review_date?: string;
}

export interface VocabListResponse {
  status: string;
  data: VocabItem[];
  total: number;
  page: number;
  limit: number;
}

export interface PracticeListResponse {
  status: string;
  data: VocabItem[];
}

export interface ManualTranslatePayload {
  word: string;
  context: string;
  english_level?: string;
}

export interface ManualTranslateResponse {
  status: string;
  vietnamese_translation?: string;
  en_explanation?: string;
  vi_explanation?: string;
  message?: string;
}

export interface ProgressUpdatePayload {
  word: string;
  quality: number;
  context?: string;
  translation?: string;
}

export interface ProgressUpdateResponse {
  status: string;
  new_status?: string;
  quality?: number;
  repetitions?: number;
  interval_days?: number;
  ease_factor?: number;
  next_review_date?: string;
}

export const getVocabStats = async (): Promise<VocabStats> => {
  return requestJson<VocabStats>("/api/vocab/stats", {
    method: "GET",
  });
};

export const getVocabList = async (
  page = 1,
  limit = 20,
  search?: string,
  status?: string,
  specialization?: string,
  difficulty?: string
): Promise<VocabListResponse> => {
  let query = `?page=${page}&limit=${limit}`;
  if (search) query += `&search=${encodeURIComponent(search)}`;
  if (status) query += `&status=${status}`;
  if (specialization) query += `&specialization=${specialization}`;
  if (difficulty) query += `&difficulty=${difficulty}`;
  return requestJson<VocabListResponse>(`/api/vocab/list${query}`, {
    method: "GET",
  });
};

export const getPracticeList = async (): Promise<PracticeListResponse> => {
  return requestJson<PracticeListResponse>("/api/vocab/practice", {
    method: "GET",
  });
};

export const translateManual = async (
  payload: ManualTranslatePayload
): Promise<ManualTranslateResponse> => {
  return requestJson<ManualTranslateResponse>("/api/translate-manual", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const updateVocabProgress = async (
  payload: ProgressUpdatePayload
): Promise<ProgressUpdateResponse> => {
  return requestJson<ProgressUpdateResponse>("/api/update-progress", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const updateProgress = async (
  payload: ProgressUpdatePayload
): Promise<ProgressUpdateResponse> => {
  return updateVocabProgress(payload);
};
