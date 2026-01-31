
import { EntityState } from "../contexts/HomeAssistantContext";

export const filterSecurityEntities = (entities: EntityState[]) => {
    return entities.filter(e => {
        if (!e.entity_id.startsWith('binary_sensor.')) return false;
        const id = e.entity_id.toLowerCase();
        const deviceClass = e.attributes.device_class;

        // Filter by device class or ID naming convention
        const isDoor = deviceClass === 'door' || deviceClass === 'garage_door' || deviceClass === 'window' ||
            id.includes('door') || id.includes('tür') || id.includes('fenster') || id.includes('gate');

        // Exclude common false positives if necessary
        if (id.includes('update') || id.includes('status')) return false;

        return isDoor;
    });
};
