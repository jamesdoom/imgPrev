// src/App.tsx

import { lazy, Suspense } from "react";
import { Toaster } from "react-hot-toast";

const ImageUploader = lazy(
  () => import("./components/ImageUploader/ImageUploader")
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

      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Suspense
          fallback={
            <div className="text-sm font-medium text-gray-600">
              Loading editor...
            </div>
          }
        >
          <ImageUploader />
        </Suspense>
      </main>
    </>
  );
}

export default App;
