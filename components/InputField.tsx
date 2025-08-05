

export default function InputField() {
    return (
        <div className="h-12">
            <div className="flex items-center rounded-md bg-white px-3 outline-1 -outline-offset-1 outline-gray-300 has-[input:focus-within]:outline-2 has-[input:focus-within]:-outline-offset-2 has-[input:focus-within]:outline-[var(--accent)]">
                <input id="price" type="text" name="price" placeholder="Discount Coupon Code" className="h-12 w-full block grow py-1.5 pr-3 pl-1 text-base text-[var(--secondary)] placeholder:text-gray-400 focus:outline-none sm:text-sm/6" />
                <div className="w-[30px] h-[30px] flex items-center justify-center bg-[var(--accent)] rounded-full focus-within:relative">
                    
                </div>
            </div>
        </div>
    );
}