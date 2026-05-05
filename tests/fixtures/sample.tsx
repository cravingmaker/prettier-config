interface Props { name: string; }

export const Greeting = ( { name }: Props ) => {
  return (
    <div   className="greeting"  >
      <h1 >Hello, { name }!</h1>
    </div>
  );
};
