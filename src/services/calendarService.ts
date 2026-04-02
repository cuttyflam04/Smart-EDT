import { GoogleGenAI, Type } from "@google/genai";

export interface CalendarEvent {
  title: string;
  day: string; // e.g., "Lundi", "Mardi", etc.
  startTime: string; // e.g., "08:30"
  endTime: string; // e.g., "10:30"
  room?: string;
  teacher?: string;
  type?: string; // e.g., "CM", "TD", "TP"
}

export const generateCalendarEvents = async (ocrText: string, filterKeywords?: string[]): Promise<CalendarEvent[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const filterInstruction = filterKeywords && filterKeywords.length > 0 
      ? `\nIMPORTANT: Ne retourne QUE les cours qui correspondent à ces mots-clés (titre, groupe, ou type): ${filterKeywords.join(', ')}.`
      : "";

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Transforme ce texte d'emploi du temps en une liste JSON d'événements. 
      Chaque événement doit avoir: title, day, startTime, endTime, room, teacher, type.
      Sois précis sur les horaires et les jours. ${filterInstruction}
      Texte: ${ocrText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              day: { type: Type.STRING },
              startTime: { type: Type.STRING },
              endTime: { type: Type.STRING },
              room: { type: Type.STRING },
              teacher: { type: Type.STRING },
              type: { type: Type.STRING }
            },
            required: ["title", "day", "startTime", "endTime"]
          }
        }
      }
    });

    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch (error: any) {
    console.error('Gemini Calendar Error:', error);
    throw new Error("Erreur lors de la génération du calendrier par l'IA.");
  }
};

export const generateICS = (events: CalendarEvent[]): string => {
  const formatDate = (day: string, time: string) => {
    // This is a simplified version, ideally we'd need a base date
    // For now, we'll just use a generic week
    const days: Record<string, number> = {
      'Lundi': 1, 'Mardi': 2, 'Mercredi': 3, 'Jeudi': 4, 'Vendredi': 5, 'Samedi': 6, 'Dimanche': 0
    };
    
    // Find the day index, defaulting to Monday if not found
    const dayIndex = days[day.charAt(0).toUpperCase() + day.slice(1).toLowerCase()] || 1;
    
    // Use a fixed week in the future (e.g., April 2026)
    // 2026-04-06 is a Monday
    const baseDate = new Date(2026, 3, 6 + (dayIndex - 1));
    const [hours, minutes] = time.split(':').map(Number);
    baseDate.setHours(hours, minutes, 0, 0);
    
    return baseDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SmartEDT//NONSGML v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  events.forEach(event => {
    const start = formatDate(event.day, event.startTime);
    const end = formatDate(event.day, event.endTime);
    
    ics.push('BEGIN:VEVENT');
    ics.push(`SUMMARY:${event.title}${event.type ? ` (${event.type})` : ''}`);
    ics.push(`DTSTART:${start}`);
    ics.push(`DTEND:${end}`);
    if (event.room) ics.push(`LOCATION:${event.room}`);
    if (event.teacher) ics.push(`DESCRIPTION:Enseignant: ${event.teacher}`);
    ics.push('END:VEVENT');
  });

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
};
