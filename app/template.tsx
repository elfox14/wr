import type { ReactNode } from 'react';

export default function Template({ children }: { children: ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            section[aria-label="مركز المباريات المصحح"] span[class*="text-[9px]"][class*="font-black"][class*="text-[#FFD700]"] {
              display: none !important;
            }
          `,
        }}
      />
      {children}
    </>
  );
}
