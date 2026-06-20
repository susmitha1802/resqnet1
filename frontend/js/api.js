/**
 * ResQNet — API Helper
 * Centralized fetch wrapper for all backend calls
 */

const API_BASE = 'http://127.0.0.1:5000';

const Api = {
  /** Get JWT token from localStorage */
  getToken() {
    return localStorage.getItem('resqnet_token');
  },

  /** Build headers */
  headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    const token = this.getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  },

  /** GET request */
  async get(endpoint) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: this.headers()
      });
      return await res.json();
    } catch (err) {
      console.warn(`[API] GET ${endpoint} failed (offline?):`, err.message);
      return null;
    }
  },

  /** POST request */
  async post(endpoint, body) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch (err) {
      console.warn(`[API] POST ${endpoint} failed (offline?):`, err.message);
      return null;
    }
  },

  /** PUT request */
  async put(endpoint, body) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch (err) {
      console.warn(`[API] PUT ${endpoint} failed (offline?):`, err.message);
      return null;
    }
  },

  /** DELETE request */
  async delete(endpoint) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'DELETE',
        headers: this.headers()
      });
      return await res.json();
    } catch (err) {
      console.warn(`[API] DELETE ${endpoint} failed (offline?):`, err.message);
      return null;
    }
  },

  /** POST with FormData (file upload) */
  async postForm(endpoint, formData) {
    try {
      const h = {};
      const token = this.getToken();
      if (token) h['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: h,
        body: formData
      });
      return await res.json();
    } catch (err) {
      console.warn(`[API] POST (form) ${endpoint} failed:`, err.message);
      return null;
    }
  }
};

window.Api = Api;
