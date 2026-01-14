"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

type User = {
    id: string;
    name: string;
    email: string;
    role: "admin";
};

type AuthContextType = {
    user: User | null;
    login: (email: string) => void;
    logout: () => void;
    isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Check local storage for session
        const storedUser = localStorage.getItem("minimal_admin_user");
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (!isLoading && !user && pathname !== "/login") {
            router.push("/login");
        }
    }, [user, isLoading, pathname, router]);

    const login = (email: string) => {
        const newUser: User = {
            id: "1",
            name: "Admin User",
            email,
            role: "admin",
        };
        setUser(newUser);
        localStorage.setItem("minimal_admin_user", JSON.stringify(newUser));
        router.push("/");
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("minimal_admin_user");
        router.push("/login");
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
