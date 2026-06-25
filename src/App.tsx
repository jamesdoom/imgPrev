// src/App.tsx

import { lazy, Suspense } from "react";
import { Toaster } from "react-hot-toast";

const AdminReviewScreen = lazy(() => import("./admin/AdminReviewScreen"));
const StickerSheetDesigner = lazy(
  () => import("./components/StickerSheetDesigner/StickerSheetDesigner")
);

function App() {
  const isAdminRoute = window.location.pathname.startsWith("/admin");

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
              {isAdminRoute ? "Loading admin..." : "Loading editor..."}
            </div>
          }
        >
          {isAdminRoute ? <AdminReviewScreen /> : <StickerSheetDesigner />}
        </Suspense>
      </main>
    </>
  );
}

export default App;
