import ananyaPhoto from "@/assets/demo-profile-ananya.jpg";
import aryaPhoto from "@/assets/demo-profile-arya.jpg";
import ishaPhoto from "@/assets/demo-profile-isha.jpg";
import rohanPhoto from "@/assets/demo-profile-rohan.jpg";

export type DemoProfile = {
  name: string;
  age: number;
  course: string;
  year: string;
  bio: string;
  interests: string[];
  photo: string;
};

export const demoProfiles: DemoProfile[] = [
  {
    name: "Isha",
    age: 21,
    course: "Design & Media",
    year: "3rd year",
    bio: "Collecting little rituals: late coffee, old bookstores, and long walks with no destination.",
    interests: ["Photography", "Film", "Coffee"],
    photo: ishaPhoto,
  },
  {
    name: "Rohan",
    age: 22,
    course: "Computer Science",
    year: "4th year",
    bio: "Usually looking for a new playlist, a better dumpling spot, or a reason to stay out a little longer.",
    interests: ["Live music", "Food", "Running"],
    photo: rohanPhoto,
  },
  {
    name: "Arya",
    age: 20,
    course: "Psychology",
    year: "2nd year",
    bio: "Soft spot for rainy afternoons, ambitious playlists, and conversations that wander.",
    interests: ["Books", "Music", "Art"],
    photo: aryaPhoto,
  },
  {
    name: "Ananya",
    age: 21,
    course: "Business & Management",
    year: "3rd year",
    bio: "A Sunday baker, enthusiastic quiz teammate, and firm believer in dessert first.",
    interests: ["Baking", "Museums", "Travel"],
    photo: ananyaPhoto,
  },
];
