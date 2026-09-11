import { Modal, View } from "react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

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
          className="w-full max-w-[440px] gap-4 rounded-2xl bg-white p-6"
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
