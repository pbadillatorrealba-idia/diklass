import { Button, ButtonText } from "@gluestack-ui/themed";

type LogoutButtonProps = { onLogout: () => Promise<void> };

export function LogoutButton({ onLogout }: LogoutButtonProps) {
  return (
    <Button
      onPress={() => void onLogout()}
      style={{ alignSelf: "flex-start" }}
      testID="logout-button"
    >
      <ButtonText>Cerrar sesión</ButtonText>
    </Button>
  );
}
