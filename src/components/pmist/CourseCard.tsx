"use client";

// CourseCard — a single recommended course with "why it fits" and roadmap CTA.
import { Briefcase, Map } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/pmist/types";

interface CourseCardProps {
  course: Recommendation;
  onSelect: (courseCode: string) => void;
}

export function CourseCard({ course, onSelect }: CourseCardProps) {
  return (
    <Card
      className={cn(
        "gap-3 rounded-xl border-[#E8E0D4] py-4 shadow-sm",
        course.isTop && "ring-2 ring-amber-400",
      )}
    >
      <CardHeader className="gap-2 px-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-xs font-normal">
            {course.level}
          </Badge>
          <Badge variant="outline" className="text-xs font-normal">
            {course.stream}
          </Badge>
          <Badge variant="outline" className="text-xs font-normal">
            {course.duration}
          </Badge>
          {course.isTop && (
            <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-400">
              Best match
            </Badge>
          )}
        </div>
        <CardTitle className="text-base leading-snug">{course.name}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 px-4">
        <p className="text-sm text-muted-foreground">{course.description}</p>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A1E2B]">
            Why this fits you:
          </p>
          <p className="mt-0.5 text-sm">{course.whyItFits}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {course.skills.map((skill) => (
            <Badge
              key={skill}
              variant="outline"
              className="border-[#E8E0D4] text-xs font-normal text-muted-foreground"
            >
              {skill}
            </Badge>
          ))}
        </div>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Briefcase className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground">Careers: </span>
            {course.careers.join(", ")}
          </span>
        </p>
        {course.isPlaceholder && (
          <p className="text-xs italic text-muted-foreground">
            Sample entry — please verify with the admissions office.
          </p>
        )}
      </CardContent>

      <CardFooter className="px-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelect(course.code)}
          className="border-[#7A1E2B]/40 text-[#7A1E2B] hover:bg-[#FAF3EC] hover:text-[#7A1E2B]"
        >
          <Map className="h-4 w-4" aria-hidden="true" />
          View roadmap
        </Button>
      </CardFooter>
    </Card>
  );
}
