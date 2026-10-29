import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import "./theme.css";
import { AdminApp } from "./admin/AdminApp";
import { DisplayApp } from "./display/DisplayApp";
import { HostApp } from "./host/HostApp";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/display" element={<DisplayApp />} />
          <Route path="/host" element={<HostApp />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
