"use client";

// RecommendationPanel — right column (desktop) / below chat (mobile).
// Shows recommended courses, or the roadmap view when one is opened.
import { Sparkles } from "lucide-react";

import type { ProfileSummary, Recommendation, Roadmap } from "@/lib/pmist/types";
import { CourseCard } from "@/components/pmist/CourseCard";
import { RoadmapView } from "@/components/pmist/RoadmapView";

interface RecommendationPanelProps {
  profile: ProfileSummary;
  recommendations: Recommendation[] | null;
  roadmap: Roadmap | null;
  onSelectCourse: (courseCode: string) => void;
  onBackToRecommendations: () => void;
}

export function RecommendationPanel({
  profile,
  recommendations,
  roadmap,
  onSelectCourse,
  onBackToRecommendations,
}: RecommendationPanelProps) {
  if (roadmap) {
    return (
      <aside aria-label="Personalised roadmap">
        <RoadmapView roadmap={roadmap} onBack={onBackToRecommendations} />
      </aside>
    );
  }

  if (!recommendations || recommendations.length === 0) return null;

  return (
    <aside aria-label="Course recommendations" className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-amber-500" aria-hidden="true" />
        <h2 className="font-semibold text-foreground">
          Recommendations for {profile.name ?? "you"}
        </h2>
      </div>
      {recommendations.map((course) => (
        <CourseCard key={course.code} course={course} onSelect={onSelectCourse} />
      ))}
    </aside>
  );
}
