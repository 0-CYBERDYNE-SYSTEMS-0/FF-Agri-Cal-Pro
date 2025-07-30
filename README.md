# FF Agri-Cal Minimal UI

This is a minimal, modular version of the FF Agri-Cal app, preserving the exact user interface and agent-driven experience. Use this as a clean foundation to rebuild and extend the app, free from monolithic clutter.

---

## 🚀 Quick Start

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Start the development server:**
   ```sh
   npm run dev
   ```
   The app will be available at [http://localhost:5173](http://localhost:5173) (or as specified by Vite).

---

## 🗂️ Project Structure

- `src/App.tsx` — App shell and routing
- `src/main.tsx` — React entry point
- `src/pages/` — Main pages (Calendar, Assistant, Weather)
- `src/components/` — UI components (calendar, weather, assistant, layout)
- `src/contexts/` — React context for state management
- `src/hooks/` — Custom hooks
- `src/lib/` — Utility functions and API clients
- `src/components/ui/` — UI primitives (button, input, card, etc.)
- `src/index.css` — Main styles (Tailwind)
- `theme.json` — Theme settings

---

## 🧑‍💻 Development Notes

- **Agent-Driven:** The AI assistant can manipulate the calendar, provide suggestions, and interact with weather/location data.
- **Weather & Location:** Integrated into all interactions. Location permission and weather data are required for full functionality.
- **UI/UX:** All original UI/UX is preserved. Extend or refactor as needed.
- **API:** Backend/API calls are stubbed or minimal. Integrate your own endpoints as needed.

---

## 🛠️ Extending the App

- Add new features by creating new components in `src/components/` and new pages in `src/pages/`.
- Use React context in `src/contexts/` for global state.
- Add new hooks in `src/hooks/` for reusable logic.
- Use Tailwind CSS for styling.
- Update `theme.json` and `index.css` for theme and style changes.

---

## 🧩 Integration

- Integrate with your backend by updating API calls in `src/lib/`.
- Ensure all new features maintain modularity and backward compatibility.
- Test each pipeline (calendar, agent, weather) in isolation before integrating.

---

## 📋 Pipeline-First SWE Guidance

- **Isolate**: Work on one pipeline (calendar, agent, weather) at a time.
- **Trace**: Follow data flow from input to output for each pipeline.
- **Test**: Validate each pipeline in isolation before integrating.
- **Document**: Note all changes and reasoning for future maintainability.

---

## 📞 Need Help?
If you have questions or need guidance, contact the original developer or refer to the code comments for context.

---

Happy building! 🌱 