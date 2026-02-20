import { motion } from "framer-motion";

interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <motion.div
      className="flex flex-col gap-1"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      {description && (
        <p className="text-muted-foreground text-sm max-w-2xl text-balance">
          {description}
        </p>
      )}
    </motion.div>
  );
}
