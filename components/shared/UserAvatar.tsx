import { useState, useEffect } from "react";
import { User } from "firebase/auth";

interface UserAvatarProps {
    user: User | null;
    className?: string;
}

export function UserAvatar({ user, className = "" }: UserAvatarProps) {
    const [imageError, setImageError] = useState(false);

    // Reset error state if the user changes
    useEffect(() => {
        setImageError(false);
    }, [user?.photoURL]);

    if (!user) return null;

    const initials = user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U';

    if (user.photoURL && !imageError) {
        return (
            <img 
                src={user.photoURL} 
                alt="Avatar" 
                className={className} 
                onError={() => setImageError(true)} 
            />
        );
    }

    return (
        <div className={`bg-slate-100 flex items-center justify-center text-slate-600 font-medium ${className}`}>
            {initials}
        </div>
    );
}
