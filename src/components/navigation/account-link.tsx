import { Link } from "expo-router";
import { Pressable } from "react-native";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { useSessionStore } from "@/stores/session-store";

/**
 * Identidad de la sesión con enlace a Configuración (FR-092 · FR-093). Con `showName` pinta el
 * nombre junto al avatar; sin él, el nombre accesible del enlace lo sustituye.
 */
export function AccountLink({ showName = false }: { showName?: boolean }) {
  const displayName = useSessionStore((state) => state.displayName) ?? "";
  return (
    <Link asChild href="/settings">
      <Pressable
        accessibilityLabel={showName ? undefined : `Configuración de ${displayName}`}
        className="min-h-touch flex-row items-center gap-3 rounded-lg"
        role="link"
        testID="account-link"
      >
        <Avatar name={displayName} />
        {showName ? (
          <Text className="flex-1" variant="label">
            {displayName}
          </Text>
        ) : null}
      </Pressable>
    </Link>
  );
}
