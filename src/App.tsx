// src/App.tsx

import { lazy, Suspense } from "react";
import { Toaster } from "react-hot-toast";

const StickerSheetDesigner = lazy(
  () => import("./components/StickerSheetDesigner/StickerSheetDesigner")
);

function App() {
  return (
    <>
      <Toaster
        position="bottom-center"
        reverseOrder={false}
        toastOptions={{
          duration: 1500,
          style: {
            marginBottom: "5rem",
          },
        }}
      />

      <main className="min-h-screen bg-neutral-100">
        <Suspense
          fallback={
            <div className="text-sm font-medium text-gray-600">
              Loading editor...
            </div>
          }
        >
          <StickerSheetDesigner />
        </Suspense>
      </main>
    </>
  );
}

export default App;
