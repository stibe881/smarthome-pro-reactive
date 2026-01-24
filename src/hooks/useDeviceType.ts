import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface DeviceInfo {
    type: DeviceType;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isPortrait: boolean;
    isLandscape: boolean;
    width: number;
    height: number;
}

export const useDeviceType = (): DeviceInfo => {
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
        // Initialize with current window dimensions
        const width = typeof window !== 'undefined' ? window.innerWidth : 1920;
        const height = typeof window !== 'undefined' ? window.innerHeight : 1080;
        const isPortrait = height > width;

        let type: DeviceType = 'desktop';
        if (width < 768) {
            type = 'mobile';
        } else if (width >= 768 && width <= 1024) {
            type = 'tablet';
        }

        return {
            type,
            isMobile: type === 'mobile',
            isTablet: type === 'tablet',
            isDesktop: type === 'desktop',
            isPortrait,
            isLandscape: !isPortrait,
            width,
            height
        };
    });

    useEffect(() => {
        const checkDevice = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const isPortrait = height > width;

            let type: DeviceType = 'desktop';

            // Mobile: < 768px width
            if (width < 768) {
                type = 'mobile';
            }
            // Tablet: 768px - 1024px
            else if (width >= 768 && width <= 1024) {
                type = 'tablet';
            }
            // Desktop: > 1024px
            else {
                type = 'desktop';
            }

            setDeviceInfo({
                type,
                isMobile: type === 'mobile',
                isTablet: type === 'tablet',
                isDesktop: type === 'desktop',
                isPortrait,
                isLandscape: !isPortrait,
                width,
                height
            });
        };

        // Initial check
        checkDevice();

        // Debounced resize handler to avoid too many updates
        let timeoutId: ReturnType<typeof setTimeout>;
        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(checkDevice, 150);
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', checkDevice);

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', checkDevice);
        };
    }, []);

    return deviceInfo;
};
