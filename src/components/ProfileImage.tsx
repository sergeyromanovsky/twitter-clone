import Image from "next/image";
import React from "react";
import { VscAccount } from "react-icons/vsc";

interface Props {
  src?: string | null;
  className?: string;
}
const ProfileImage = ({ className = "", src }: Props) => {
  return (
    <div
      className={`relative h-12 w-12 overflow-hidden rounded-full ${className}`}
    >
      {src ? (
        <Image src={src} alt="Profile image" quality={100} fill />
      ) : (
        <VscAccount className="h-full w-full" />
      )}
    </div>
  );
};

export default ProfileImage;
