import { User, signInAnonymously } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "../vendor";

export const useAnonymousAuth = (): {
  user: User | null;
  error: Error | null;
} => {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (authUser) => {
      if (!user) {
        try {
          const { user: newUser } = await signInAnonymously(auth);
          setUser(newUser);
        } catch (err) {
          if (process.env.NODE_ENV === "development") {
            console.error(err);
          }
          setError(err as Error);
        }
      }
      setUser(authUser);
    });
    return unsubscribe;
  }, [user]);

  return { user, error };
};
