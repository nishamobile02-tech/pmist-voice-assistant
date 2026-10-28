"use client";

// RoadmapView — personalised preparation roadmap for one course.
import {
  BookOpen,
  Briefcase,
  Flag,
  GraduationCap,
  Lightbulb,
  Rocket,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Roadmap } from "@/lib/pmist/types";

interface RoadmapViewProps {
  roadmap: Roadmap;
  onBack: () => void;
}

interface Section {
  icon: LucideIcon;
  title: string;
  items: string[];
}

export function RoadmapView({ roadmap, onBack }: RoadmapViewProps) {
  const sections: Section[] = [
    { icon: BookOpen, title: "Foundations", items: roadmap.foundations },
    { icon: Wrench, title: "Skills to build", items: roadmap.skills },
    { icon: Lightbulb, title: "Suggested projects", items: roadmap.projects },
    { icon: Briefcase, title: "Internships & practice", items: roadmap.internships },
    { icon: Rocket, title: "Career directions", items: roadmap.careers },
    { icon: Flag, title: "Next steps", items: roadmap.nextSteps },
  ];

  return (
    <Card className="gap-3 rounded-xl border-[#E8E0D4] py-4 shadow-sm">
      <CardHeader className="gap-2 px-4">
        <div className="flex items-start gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7A1E2B] text-white"
            aria-hidden="true"
          >
            <GraduationCap className="h-4 w-4" />
          </div>
          <CardTitle className="pt-1 text-base leading-snug">
            Personalised Roadmap — {roadmap.courseName}
          </CardTitle>
        </div>
        {roadmap.personalNote && (
          <p className="text-sm italic text-muted-foreground">
            {roadmap.personalNote}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4 px-4">
        {sections.map(
          (section) =>
            section.items.length > 0 && (
              <section key={section.title}>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#7A1E2B]">
                  <section.icon className="h-4 w-4" aria-hidden="true" />
                  {section.title}
                </h3>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ),
        )}
        <p className="border-t border-[#EFE7DA] pt-3 text-xs italic text-muted-foreground">
          {roadmap.disclaimer}
        </p>
      </CardContent>

      <CardFooter className="px-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="border-[#E8E0D4] hover:bg-[#FAF3EC] hover:text-[#7A1E2B]"
        >
          Back to recommendations
        </Button>
      </CardFooter>
    </Card>
  );
}
