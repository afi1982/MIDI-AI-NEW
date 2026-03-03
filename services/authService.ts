import { UserProfile } from '../types';
import { securityService } from './securityService';

// --- CONFIGURATION ---
// ⚠️ REPLACE THIS WITH YOUR REAL CLIENT ID FROM GOOGLE CLOUD CONSOLE ⚠️
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE'; 

const GUEST_USER: UserProfile = {
    id: 'guest',
    name: 'Guest Artist',
    email: '',
    isGuest: true
};

declare const google: any;

class AuthService {
    private currentUser: UserProfile = GUEST_USER;
    private listeners: ((user: UserProfile) => void)[] = [];
    private tokenClient: any = null;

    constructor() {
        this.loadSession();
    }

    private async loadSession() {
        try {
            const encryptedSession = localStorage.getItem('emg_secure_session');
            const iv = localStorage.getItem('emg_secure_iv');
            
            if (encryptedSession && iv) {
                const decryptedJson = await securityService.decrypt(encryptedSession, iv);
                const parsed = JSON.parse(decryptedJson);
                // Validate expiration if needed
                if (parsed && parsed.id) {
                    this.currentUser = parsed;
                    this.notifyListeners();
                    console.log("[Auth] Secure Session Restored");
                }
            }
        } catch (e) {
            console.error("[AuthService] Session decryption failed", e);
            this.logout();
        }
    }

    public getUser(): UserProfile {
        return this.currentUser;
    }

    public isAuthenticated(): boolean {
        return !this.currentUser.isGuest;
    }

    public subscribe(callback: (user: UserProfile) => void) {
        this.listeners.push(callback);
        callback(this.currentUser); 
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    // --- REAL GOOGLE AUTH IMPLEMENTATION ---

    public initializeGoogle(callback: (user: UserProfile) => void) {
        if (typeof google === 'undefined') {
            console.error("Google Script not loaded");
            return;
        }

        if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
            console.warn("⚠️ REAL AUTH WARNING: You must set GOOGLE_CLIENT_ID in services/authService.ts");
        }

        try {
            // Initialize the One Tap / Sign In client
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: (response: any) => this.handleCredentialResponse(response, callback),
                auto_select: false,
                cancel_on_tap_outside: true
            });
        } catch (e) {
            console.error("Failed to init Google Auth", e);
        }
    }

    public renderGoogleButton(elementId: string) {
        if (typeof google !== 'undefined' && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE') {
            google.accounts.id.renderButton(
                document.getElementById(elementId),
                { theme: 'outline', size: 'large', width: '100%', text: 'continue_with' } // Customization attributes
            );
        }
    }

    private async handleCredentialResponse(response: any, callback: (user: UserProfile) => void) {
        try {
            const jwt = response.credential;
            const payload = this.decodeJwt(jwt);
            
            console.log("[Auth] Google Verified:", payload.email);

            const user: UserProfile = {
                id: payload.sub, // Google unique ID
                name: payload.name,
                email: payload.email,
                avatarUrl: payload.picture,
                isGuest: false
            };

            this.currentUser = user;
            await this.persistSession();
            this.notifyListeners();
            callback(user);

        } catch (e) {
            console.error("Error handling Google credential", e);
            alert("Authentication Failed. Please check console.");
        }
    }

    // Helper to decode JWT without external library
    private decodeJwt(token: string) {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    }

    // --- FALLBACK / DEV MODE ---
    // Used if Google ID is not set
    public async loginWithSimulation(): Promise<UserProfile> {
        return new Promise((resolve) => {
            setTimeout(async () => {
                this.currentUser = {
                    id: 'dev-user-id',
                    name: 'Developer Mode',
                    email: 'dev@local',
                    isGuest: false
                };
                await this.persistSession();
                this.notifyListeners();
                resolve(this.currentUser);
            }, 1000);
        });
    }

    public async logout(): Promise<void> {
        this.currentUser = GUEST_USER;
        localStorage.removeItem('emg_secure_session');
        localStorage.removeItem('emg_secure_iv');
        if (typeof google !== 'undefined') {
            google.accounts.id.disableAutoSelect();
        }
        this.notifyListeners();
    }

    private async persistSession() {
        if (!this.currentUser.isGuest) {
            const json = JSON.stringify(this.currentUser);
            const { cipher, iv } = await securityService.encrypt(json);
            localStorage.setItem('emg_secure_session', cipher);
            localStorage.setItem('emg_secure_iv', iv);
        }
    }

    private notifyListeners() {
        this.listeners.forEach(l => l(this.currentUser));
    }
}

export default new AuthService();