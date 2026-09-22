import { Button, ButtonText } from "@/components/ui/button";

type LogoutButtonProps = { onLogout: () => Promise<void> };

export function LogoutButton({ onLogout }: LogoutButtonProps) {
  return (
    <Button className="self-start" onPress={() => void onLogout()} testID="logout-button">
      <ButtonText>Cerrar sesión</ButtonText>
    </Button>
  );
}
