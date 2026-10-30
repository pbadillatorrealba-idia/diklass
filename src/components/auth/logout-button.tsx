import { useState } from "react";
import { Button, ButtonText } from "@/components/ui/button";

type LogoutButtonProps = { onLogout: () => Promise<void> };

export function LogoutButton({ onLogout }: LogoutButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const handleLogout = async () => {
    if (isPending) return;
    setIsPending(true);
    try {
      await onLogout();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      aria-busy={isPending}
      className="self-start"
      isDisabled={isPending}
      onPress={() => void handleLogout()}
      testID="logout-button"
      variant="outline"
    >
      <ButtonText>{isPending ? "Cerrando sesión…" : "Cerrar sesión"}</ButtonText>
    </Button>
  );
}
