import { Button, ButtonText, Heading, Text, VStack } from "@gluestack-ui/themed";
import { Modal, View } from "react-native";

type SessionExpiredDialogProps = {
  visible: boolean;
  onReauthenticate: () => void;
};

export function SessionExpiredDialog({ visible, onReauthenticate }: SessionExpiredDialogProps) {
  return (
    <Modal accessibilityViewIsModal animationType="fade" transparent visible={visible}>
      <View
        accessibilityViewIsModal
        style={{
          alignItems: "center",
          backgroundColor: "rgba(15, 23, 42, 0.55)",
          flex: 1,
          justifyContent: "center",
          padding: 24,
        }}
      >
        <VStack
          accessibilityLabel="Sesión expirada"
          style={{
            backgroundColor: "white",
            borderRadius: 16,
            gap: 16,
            maxWidth: 440,
            padding: 24,
            width: "100%",
          }}
        >
          <Heading>Sesión expirada</Heading>
          <Text>Tu sesión dejó de estar activa. El borrador local se conservará.</Text>
          <Button accessibilityLabel="Volver a iniciar sesión" onPress={onReauthenticate}>
            <ButtonText>Volver a iniciar sesión</ButtonText>
          </Button>
        </VStack>
      </View>
    </Modal>
  );
}
